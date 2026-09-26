create table public.player_carts (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 selected text not null default 'starter',
 unlocked text[] not null default array['starter']::text[]
);
alter table public.player_carts enable row level security;
revoke all on public.player_carts from public,anon,authenticated;
grant select,insert,update,delete on public.player_carts to service_role;
create function public.cart_garage(in_user uuid, equip text default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare stats jsonb; earned text[]; owned text[]; chosen text;
begin
 stats:=public.refresh_avatar_collection(in_user)->'stats';
 insert into public.player_carts(user_id) values(in_user) on conflict do nothing;
 select unlocked into owned from public.player_carts where user_id=in_user for update;
 select array_agg(id) into earned from (values
 ('starter','points',0),('rolls','points',250),('plunger','places',3),
 ('bubble','dailyDays',5),('royal','rankedWins',10),('hotseat','aces',15),('gold','points',3000)
 ) as c(id,metric,target) where coalesce((stats->>metric)::int,0)>=target;
 select array_agg(distinct id) into owned from unnest(owned||earned) id;
 if equip is not null and not(equip=any(owned)) then raise exception 'That cart is still locked'; end if;
 update public.player_carts set unlocked=owned,selected=coalesce(equip,selected) where user_id=in_user returning selected into chosen;
 return jsonb_build_object('selected',chosen,'unlocked',owned,'stats',stats);
end;
$$;
revoke all on function public.cart_garage(uuid,text) from public,anon,authenticated;
grant execute on function public.cart_garage(uuid,text) to service_role;

-- Carry the garage with an account when it is linked onto another phone.
create or replace function public.move_account_with_heads(old_id uuid,new_id uuid)
returns text language plpgsql security invoker set search_path=public as $$
declare n text; old_avatar jsonb;
begin
 if old_id=new_id then raise exception 'same account'; end if;
 perform refresh_avatar_collection(old_id); perform refresh_avatar_collection(new_id);
 select avatar into old_avatar from profiles where id=old_id;
 insert into avatar_head_unlocks(user_id,head_id,unlocked_at)
 select new_id,head_id,unlocked_at from avatar_head_unlocks where user_id=old_id on conflict do nothing;
 insert into avatar_gear_unlocks(user_id,slot,item_id,unlocked_at)
 select new_id,slot,item_id,unlocked_at from avatar_gear_unlocks where user_id=old_id on conflict do nothing;
 insert into player_activity_days(user_id,activity_date)
 select new_id,activity_date from player_activity_days where user_id=old_id on conflict do nothing;
 insert into player_carts(user_id,selected,unlocked)
 select new_id,selected,unlocked from player_carts where user_id=old_id
 on conflict(user_id) do update set selected=excluded.selected,
 unlocked=(select array_agg(distinct id) from unnest(player_carts.unlocked||excluded.unlocked) id);
 n:=move_account(old_id,new_id);
 if old_avatar is not null then update profiles set avatar=old_avatar where id=new_id; end if;
 return n;
end;
$$;
revoke all on function public.move_account_with_heads(uuid,uuid) from public,anon,authenticated;
grant execute on function public.move_account_with_heads(uuid,uuid) to service_role;
