-- Access-controlled entry points above are the only writers. Clients cannot forge remote check-ins.
revoke insert,update,delete on public.checkins,public.runs,public.locations from public,anon,authenticated;
create table public.store_revocations(transaction_id text primary key, received_at timestamptz not null default now());
alter table public.store_revocations enable row level security;
create function public.revoke_store_purchase(p_transaction text) returns boolean language plpgsql security invoker set search_path='' as $$
declare t public.store_transactions; credited int;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_transaction,17));
 insert into public.store_revocations values(p_transaction,now()) on conflict do nothing;
 select * into t from public.store_transactions where id=p_transaction for update;
 if not found then return true; end if;
 if t.revoked_at is not null then return false; end if;
 select amount into credited from public.wallet_ledger where event_key='apple:'||p_transaction;
 update public.store_transactions set revoked_at=now() where id=p_transaction;
 delete from public.store_entitlements where transaction_id=p_transaction;
 if t.product_id in ('starter','royal_style') then
 update public.profiles p set avatar=(select jsonb_object_agg(k,case when v=to_jsonb(case when t.product_id='starter' then 'welcomeTour'::text else 'regaliaTour'::text end) then to_jsonb(case k when 'ball' then 'white' when 'hat' then 'none' else 'white' end) else v end) from jsonb_each(p.avatar) as parts(k,v))
 where p.id=t.user_id and p.avatar is not null;
 end if;
 insert into public.wallet_ledger(user_id,amount,event_key,reason) values(t.user_id,-coalesce(credited,0),'refund:'||p_transaction,'Apple refund');
 update public.token_wallets set balance=balance-coalesce(credited,0) where user_id=t.user_id;
 return true;
end $$;
revoke all on function public.revoke_store_purchase(text) from public,anon,authenticated;
grant execute on function public.revoke_store_purchase(text) to service_role;
create function public.refund_failed_attempt(p_request uuid) returns boolean language plpgsql security invoker set search_path='' as $$
declare a public.remote_attempts;
begin
 select * into a from public.remote_attempts where id=p_request for update;
 if not found or a.refunded_at is not null then return false; end if;
 if exists(select 1 from public.runs where location_id=a.location_id and user_id=a.user_id and round_started_at=a.started_at) then raise exception 'Completed round cannot be refunded'; end if;
 update public.remote_attempts set refunded_at=now() where id=p_request;
 update public.checkins set started_at=null where user_id=a.user_id and location_id=a.location_id and started_at=a.started_at;
 insert into public.wallet_ledger(user_id,amount,event_key,reason) values(a.user_id,1,'technical-refund:'||a.id,'Remote challenge technical refund');
 update public.token_wallets set balance=balance+1 where user_id=a.user_id;
 return true;
end $$;
revoke all on function public.refund_failed_attempt(uuid) from public,anon,authenticated;
grant execute on function public.refund_failed_attempt(uuid) to service_role;
create function public.match_activity() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.status='done' and old.status is distinct from 'done' then
  insert into public.activity_events(user_id,category,title,message,match_id,event_key)
  select p.id,'friends','Match result',case when new.winner is null then 'Your match ended in a tie.' when new.winner=p.id then 'You won! See the scorecard.' else 'Your match is finished. See the scorecard.' end,new.id,'match:'||new.id
  from public.profiles p where p.id in(new.p1,new.p2) and not p.is_bot on conflict do nothing;
 end if;return new;end $$;
revoke all on function public.match_activity() from public,anon,authenticated;
create trigger match_activity after update of status on public.matches for each row execute function public.match_activity();
create function public.invite_activity() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 insert into public.activity_events(user_id,category,title,message,match_id,event_key) values(new.to_user,'friends','You’ve been challenged!',coalesce((select display_name from public.profiles where id=new.from_user),'A friend')||' invited you to a match.',new.match_id,'invite:'||new.id) on conflict do nothing;
 return new;end $$;
revoke all on function public.invite_activity() from public,anon,authenticated;
create trigger invite_activity after insert on public.match_invites for each row execute function public.invite_activity();
create function public.schedule_throne_activity() returns void language plpgsql security invoker set search_path='' as $$
begin
 insert into public.activity_events(user_id,category,title,message,location_id,event_key)
 select d.user_id,'defenses','Your throne is weakening',l.name||': matching your score now captures the crown. Play a fresh defense to reset it.',d.location_id,'aging:'||d.run_id
 from public.throne_defenses d join public.locations l on l.id=d.location_id and l.status='live' where now()-d.defended_at between interval '48 hours' and interval '49 hours' on conflict do nothing;
 insert into public.activity_events(user_id,category,title,message,event_key)
 select user_id,'daily','Daily course is open','A fresh scorecard is waiting. Play today’s course!','daily:'||to_char(now() at time zone 'America/New_York','YYYY-MM-DD')
 from public.notification_preferences where daily and extract(hour from now() at time zone timezone)=12 on conflict do nothing;
end $$;
revoke all on function public.schedule_throne_activity() from public,anon,authenticated;
grant execute on function public.schedule_throne_activity() to service_role;
alter table public.activity_events add column push_lease_until timestamptz;
create function public.lease_push_events() returns setof public.activity_events language sql security invoker set search_path='' as $$
 update public.activity_events set push_lease_until=now()+interval '90 seconds' where id in
 (select id from public.activity_events where push_status='pending' and coalesce(push_lease_until,'-infinity')<now() order by created_at limit 40 for update skip locked) returning * $$;
revoke all on function public.lease_push_events() from public,anon,authenticated;
grant execute on function public.lease_push_events() to service_role;

create or replace function public.credit_store_purchase(p_user uuid,p_transaction text,p_product text,p_environment text) returns boolean language plpgsql security invoker set search_path='' as $$
declare tokens int; previous public.store_transactions;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_transaction,17));
 if exists(select 1 from public.store_revocations where transaction_id=p_transaction) then raise exception 'Purchase has been revoked'; end if;
 tokens:=case p_product when 'teleport3' then 3 when 'teleport10' then 10 when 'starter' then 2 when 'royal_style' then 0 else null end;
 if tokens is null then raise exception 'Unknown product'; end if;
 insert into public.token_wallets(user_id) values(p_user) on conflict do nothing;
 perform 1 from public.token_wallets where user_id=p_user for update;
 select * into previous from public.store_transactions where id=p_transaction;
 if found then
  if previous.user_id<>p_user then raise exception 'Purchase belongs to another account'; end if;
  return false;
 end if;
 insert into public.store_transactions(id,user_id,product_id,environment) values(p_transaction,p_user,p_product,p_environment);
 update public.token_wallets set balance=balance+tokens where user_id=p_user;
 insert into public.wallet_ledger(user_id,amount,event_key,reason) values(p_user,tokens,'apple:'||p_transaction,'Apple purchase');
 if p_product in('starter','royal_style') then insert into public.store_entitlements values(p_user,p_product,p_transaction) on conflict do nothing; end if;
 return true;
end $$;
create or replace function public.start_remote_attempt(p_user uuid,p_location text,p_request uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare existing public.remote_attempts; clock timestamptz:=date_trunc('milliseconds',clock_timestamp()); amount int;
begin
 insert into public.token_wallets(user_id) values(p_user) on conflict do nothing;
 select balance into amount from public.token_wallets where user_id=p_user for update;
 select * into existing from public.remote_attempts where id=p_request;
 if found then
  if existing.user_id<>p_user or existing.location_id<>p_location then raise exception 'Invalid request'; end if;
  if existing.refunded_at is not null or not exists(select 1 from public.checkins where user_id=p_user and location_id=p_location and started_at=existing.started_at) then raise exception 'This remote attempt has ended'; end if;
  return jsonb_build_object('startedAt',existing.started_at);
 end if;
 if amount<1 then raise exception 'You need a teleport pass'; end if;
 if not exists(select 1 from public.locations where id=p_location and status='live' and jsonb_array_length(holes)=3) then raise exception 'This course is not ready'; end if;
 if not exists(select 1 from public.location_visits where user_id=p_user and location_id=p_location) then raise exception 'Visit this public throne in person first'; end if;
 if exists(select 1 from public.checkins where user_id=p_user and started_at>now()-interval '45 minutes') then raise exception 'Finish or concede your active round first'; end if;
 if (select count(*) from public.remote_attempts where user_id=p_user and refunded_at is null and (started_at at time zone 'America/New_York')::date=(now() at time zone 'America/New_York')::date)>=3 then raise exception 'Three remote challenges per day. Come back tomorrow.'; end if;
 insert into public.remote_attempts(id,user_id,location_id,started_at) values(p_request,p_user,p_location,clock);
 update public.token_wallets set balance=balance-1 where user_id=p_user;
 insert into public.wallet_ledger(user_id,amount,event_key,reason) values(p_user,-1,'remote:'||p_request,'Remote throne challenge');
 insert into public.checkins(user_id,location_id,lat,lng,accuracy,at,started_at,remote) values(p_user,p_location,0,0,0,clock,clock,true)
 on conflict(user_id,location_id) do update set at=clock,started_at=clock,remote=true,lat=0,lng=0,accuracy=0;
 return jsonb_build_object('startedAt',clock);
end $$;
create or replace function public.earn_weekly_passes(p_user uuid) returns integer language plpgsql security invoker set search_path='' as $$
declare k text:='weekly:'||p_user||':'||to_char(now() at time zone 'America/New_York','IYYY-IW'); awarded int;
begin
 if not exists(select 1 from public.runs where user_id=p_user and location_id is not null and array_length(hole_scores,1)=3 and created_at >= date_trunc('week',now() at time zone 'America/New_York') at time zone 'America/New_York')
 and not exists(select 1 from public.runs where user_id=p_user and location_id is null and course_seed ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}-pm$' and created_at >= date_trunc('week',now() at time zone 'America/New_York') at time zone 'America/New_York' group by course_seed having count(distinct hole_index)>=9)
 and not exists(select 1 from public.matches where status='done' and not coalesce(forfeit,false) and (p1=p_user or p2=p_user) and finished_at >= date_trunc('week',now() at time zone 'America/New_York') at time zone 'America/New_York') then raise exception 'Finish a verified round this week to earn two passes'; end if;
 insert into public.token_wallets(user_id) values(p_user) on conflict do nothing;
 perform 1 from public.token_wallets where user_id=p_user for update;
 insert into public.wallet_ledger(user_id,amount,event_key,reason) values(p_user,2,k,'Weekly play reward') on conflict(event_key) do nothing;
 get diagnostics awarded=row_count;
 update public.token_wallets set balance=balance+2*awarded where user_id=p_user;
 return awarded*2;
end $$;

create function public.wins_defense(challenger integer, elapsed integer, incumbent integer, prior_elapsed integer, defended_at timestamptz, as_of timestamptz)
returns boolean language sql immutable set search_path='' as $$
 select challenger < incumbent or (challenger=incumbent and (as_of>=defended_at+interval '48 hours' or coalesce(elapsed<prior_elapsed,false)))
 or (as_of>=defended_at+interval '72 hours' and challenger<=incumbent+public.defense_allowance(defended_at,as_of));
$$;
create or replace function public.capture_current_throne() returns trigger language plpgsql security invoker set search_path='' as $$
declare incumbent public.throne_defenses; place text; who text;
begin
 if new.location_id is null or new.hole_scores is null then return new; end if;
 -- Serialize all challengers to this throne, including first captures.
 perform pg_advisory_xact_lock(hashtextextended(new.location_id,0));
 select name into place from public.locations where id=new.location_id and status='live';
 if not found then raise exception 'This place is not approved for challenges'; end if;
 select * into incumbent from public.throne_defenses where location_id=new.location_id for update;
 select display_name into who from public.profiles where id=new.user_id;
 if incumbent.user_id is null or incumbent.user_id=new.user_id or public.wins_defense(new.score,new.elapsed_ms,incumbent.score,(select elapsed_ms from public.runs where id=incumbent.run_id),incumbent.defended_at,now()) then
   insert into public.throne_defenses values(new.location_id,new.id,new.user_id,new.score,now())
   on conflict(location_id) do update set run_id=excluded.run_id,user_id=excluded.user_id,score=excluded.score,defended_at=excluded.defended_at;
   if incumbent.user_id is not null and incumbent.user_id<>new.user_id then
     insert into public.activity_events(user_id,category,title,message,location_id,event_key)
     values(incumbent.user_id,'crowns','Your throne was taken!',who||' took '||place||' with '||new.score||' strokes. Challenge again!',new.location_id,'capture:'||new.id);
   end if;
   insert into public.activity_events(user_id,category,title,message,location_id,event_key)
   values(new.user_id,'crowns',case when incumbent.user_id=new.user_id then 'Throne defended!' else 'The crown is yours!' end,
     'Your new defense at '||place||' is '||new.score||'. For 48 hours, challengers must beat your score or tie it faster.',new.location_id,'result:'||new.id);
 elsif incumbent.user_id<>new.user_id then
   insert into public.activity_events(user_id,category,title,message,location_id,event_key)
   values(incumbent.user_id,'defenses','Your defense held',who||' shot '||new.score||' at '||place||'. You still own the throne.',new.location_id,'defense:'||new.id);
 end if;
 return new;
end $$;

create extension if not exists pg_cron;
select cron.schedule('ppp-preview-activity','*/15 * * * *','select public.schedule_throne_activity()');

create function public.guard_premium_look() returns trigger language plpgsql security invoker set search_path='' as $$
declare slot text; product text;
begin
 foreach slot in array array['seat','hat','ball'] loop
  product:=case new.avatar->>slot when 'regaliaTour' then 'royal_style' when 'welcomeTour' then 'starter' end;
  if product is not null and not exists(select 1 from public.store_entitlements where user_id=new.id and product_id=product) then raise exception 'Unlock this look in the Potty Shop first'; end if;
 end loop;return new;
end $$;
revoke all on function public.guard_premium_look() from public,anon,authenticated;
create trigger guard_premium_look before insert or update of avatar on public.profiles for each row execute function public.guard_premium_look();
create or replace function public.cart_garage(in_user uuid, equip text default null)
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
 owned:=array_remove(owned,'amethyst');
 if exists(select 1 from public.store_entitlements where user_id=in_user and product_id='royal_style') then owned:=owned||array['amethyst'];stats:=stats||'{"royalStyle":1}'::jsonb;end if;
 if equip is not null and not(equip=any(owned)) then raise exception 'That cart is still locked'; end if;
 update public.player_carts set unlocked=owned,selected=coalesce(equip,case when selected=any(owned) then selected else 'starter' end) where user_id=in_user returning selected into chosen;
 return jsonb_build_object('selected',chosen,'unlocked',owned,'stats',stats);
end;
$$;
