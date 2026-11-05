-- Preview only. OG game production is never a deployment target for this branch.
create table public.throne_defenses (
 location_id text primary key references public.locations(id) on delete cascade,
 run_id uuid not null references public.runs(id), user_id uuid not null references public.profiles(id),
 score integer not null check(score>=3), defended_at timestamptz not null default now()
);
alter table public.throne_defenses enable row level security;
create policy defense_read on public.throne_defenses for select using (exists(select 1 from public.locations l where l.id=location_id and l.status='live'));
grant select on public.throne_defenses to anon,authenticated;
insert into public.throne_defenses select distinct on(r.location_id) r.location_id,r.id,r.user_id,r.score,r.created_at
 from public.runs r join public.locations l on l.id=r.location_id and l.status='live'
 where r.hole_scores is not null and r.season=public.current_season() order by r.location_id,r.score,coalesce(r.elapsed_ms,2147483647),r.created_at;
create function public.defense_allowance(at_time timestamptz, as_of timestamptz default now()) returns integer
language sql immutable set search_path='' as $$select least(3,greatest(0,floor(extract(epoch from(as_of-at_time))/86400)::int-2))$$;
create or replace view public.thrones with(security_invoker=true) as
 select d.location_id,public.current_season() as season,d.user_id,p.display_name,p.avatar,d.score,r.par,r.hole_scores,r.elapsed_ms,d.defended_at as created_at
 from public.throne_defenses d join public.runs r on r.id=d.run_id join public.profiles p on p.id=d.user_id
 join public.locations l on l.id=d.location_id and l.status='live';

create table public.activity_events (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 category text not null check(category in('crowns','defenses','friends','daily','submissions','rewards')),
 title text not null, message text not null, location_id text, match_id uuid,
 event_key text not null, created_at timestamptz not null default now(), read_at timestamptz,
 push_status text not null default 'pending' check(push_status in('pending','sent','skipped')), unique(user_id,event_key)
);
create index activity_user_date on public.activity_events(user_id,created_at desc);
alter table public.activity_events enable row level security;
create policy activity_read on public.activity_events for select to authenticated using(user_id=auth.uid());
grant select on public.activity_events to authenticated;
create table public.notification_preferences (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 crowns boolean not null default true, defenses boolean not null default false, friends boolean not null default true,
 daily boolean not null default false, submissions boolean not null default true, rewards boolean not null default false,
 quiet_start integer not null default 22 check(quiet_start between 0 and 23), quiet_end integer not null default 8 check(quiet_end between 0 and 23),
 timezone text not null default 'America/New_York'
);
alter table public.notification_preferences enable row level security;
create policy preferences_read on public.notification_preferences for select to authenticated using(user_id=auth.uid());
grant select on public.notification_preferences to authenticated;
create table public.push_devices (
 token text primary key, user_id uuid not null references public.profiles(id) on delete cascade,
 environment text not null check(environment in('sandbox','production')), updated_at timestamptz not null default now()
);
alter table public.push_devices enable row level security;

create function public.capture_current_throne() returns trigger language plpgsql security invoker set search_path='' as $$
declare old public.throne_defenses; place text; who text;
begin
 if new.location_id is null or new.hole_scores is null then return new; end if;
 -- Serialize all challengers to this throne, including first captures.
 perform pg_advisory_xact_lock(hashtextextended(new.location_id,0));
 select name into place from public.locations where id=new.location_id and status='live';
 if not found then raise exception 'This place is not approved for challenges'; end if;
 select * into old from public.throne_defenses where location_id=new.location_id for update;
 select display_name into who from public.profiles where id=new.user_id;
 if old.user_id is null or old.user_id=new.user_id or (new.score<old.score or (new.score=old.score and (now()>=old.defended_at+interval '48 hours' or new.elapsed_ms<(select coalesce(elapsed_ms,2147483647) from public.runs where id=old.run_id))) or (now()>=old.defended_at+interval '72 hours' and new.score<=old.score+public.defense_allowance(old.defended_at))) then
   insert into public.throne_defenses values(new.location_id,new.id,new.user_id,new.score,now())
   on conflict(location_id) do update set run_id=excluded.run_id,user_id=excluded.user_id,score=excluded.score,defended_at=excluded.defended_at;
   if old.user_id is not null and old.user_id<>new.user_id then
     insert into public.activity_events(user_id,category,title,message,location_id,event_key)
     values(old.user_id,'crowns','Your throne was taken!',who||' took '||place||' with '||new.score||' strokes. Challenge again!',new.location_id,'capture:'||new.id);
   end if;
   insert into public.activity_events(user_id,category,title,message,location_id,event_key)
   values(new.user_id,'crowns',case when old.user_id=new.user_id then 'Throne defended!' else 'The crown is yours!' end,
     'Your new defense at '||place||' is '||new.score||'. For 48 hours, challengers must beat your score or tie it faster.',new.location_id,'result:'||new.id);
 elsif old.user_id<>new.user_id then
   insert into public.activity_events(user_id,category,title,message,location_id,event_key)
   values(old.user_id,'defenses','Your defense held',who||' shot '||new.score||' at '||place||'. You still own the throne.',new.location_id,'defense:'||new.id);
 end if;
 return new;
end $$;
revoke all on function public.capture_current_throne() from public,anon,authenticated;
create trigger a_capture_current_throne after insert on public.runs for each row execute function public.capture_current_throne();
-- Pending suggestions must never be publicly readable, even via direct REST.
drop policy "locations are public" on public.locations;
create policy approved_locations on public.locations for select using(status='live' or founded_by=auth.uid() or public.is_admin());
create or replace function public.nearby_locations(in_lat double precision,in_lng double precision,radius_m double precision default 2000)
returns table(id text,name text,poi_type text,lat double precision,lng double precision,theme text,difficulty text,hole_par int,par int,distance_m double precision,king_name text,king_score int,king_user uuid,king_since timestamptz,king_holes int[],king_elapsed_ms int,king_avatar jsonb,run_count bigint,status text)
language sql stable set search_path=public as $$
 select l.id,l.name,l.poi_type,l.lat,l.lng,l.theme,l.difficulty,l.hole_par,l.par,st_distance(l.geog,st_setsrid(st_makepoint(in_lng,in_lat),4326)::geography),
 t.display_name,t.score,t.user_id,t.created_at,t.hole_scores,t.elapsed_ms,t.avatar,(select count(*) from public.runs r where r.location_id=l.id),l.status
 from public.locations l left join public.thrones t on t.location_id=l.id
 where l.status='live' and st_dwithin(l.geog,st_setsrid(st_makepoint(in_lng,in_lat),4326)::geography,radius_m) order by 10 limit 200 $$;
alter table public.locations add column access_type text not null default 'public' check(access_type in('public','customers'));
alter table public.locations add column review_note text;
alter table public.locations add column reviewed_by uuid references public.profiles(id);
alter table public.locations add column reviewed_at timestamptz;
create table public.place_review_history(id uuid primary key default gen_random_uuid(),location_id text not null references public.locations(id),admin_id uuid not null references public.profiles(id),decision text not null,note text,created_at timestamptz not null default now());
alter table public.place_review_history enable row level security;
create function public.location_review_activity() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.status='pending' and (tg_op='INSERT' or old.status is distinct from new.status) then
  insert into public.activity_events(user_id,category,title,message,location_id,event_key)
  select id,'submissions','New potty to review',new.name||' is waiting for your review.',new.id,'review:'||new.id||':'||now() from public.profiles where role='admin';
 elsif tg_op='UPDATE' and old.status is distinct from new.status and new.founded_by is not null then
  insert into public.activity_events(user_id,category,title,message,location_id,event_key)
  values(new.founded_by,'submissions',case when new.status='live' then 'Your potty is on the map!' else 'Potty submission updated' end,new.name||': '||coalesce(new.review_note,new.status),new.id,'review-result:'||new.id||':'||now());
 end if;
 return new;
end $$;
revoke all on function public.location_review_activity() from public,anon,authenticated;
create trigger location_review_activity after insert or update of status on public.locations for each row execute function public.location_review_activity();

create table public.location_visits(user_id uuid not null references public.profiles(id) on delete cascade,location_id text not null references public.locations(id),visited_at timestamptz not null default now(),primary key(user_id,location_id));
alter table public.location_visits enable row level security;
create policy visits_read on public.location_visits for select to authenticated using(user_id=auth.uid());
grant select on public.location_visits to authenticated;
alter table public.checkins add column remote boolean not null default false;
create table public.token_wallets(user_id uuid primary key references public.profiles(id) on delete cascade,balance int not null default 0);
alter table public.token_wallets enable row level security;
create policy wallet_read on public.token_wallets for select to authenticated using(user_id=auth.uid());
grant select on public.token_wallets to authenticated;
create table public.wallet_ledger(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,amount int not null,event_key text not null unique,reason text not null,created_at timestamptz not null default now());
alter table public.wallet_ledger enable row level security;
create policy ledger_read on public.wallet_ledger for select to authenticated using(user_id=auth.uid());
grant select on public.wallet_ledger to authenticated;
create table public.remote_attempts(id uuid primary key,user_id uuid not null references public.profiles(id),location_id text not null references public.locations(id),started_at timestamptz not null,refunded_at timestamptz);
alter table public.remote_attempts enable row level security;
create function public.start_remote_attempt(p_user uuid,p_location text,p_request uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare existing public.remote_attempts; clock timestamptz:=clock_timestamp(); amount int;
begin
 insert into public.token_wallets(user_id) values(p_user) on conflict do nothing;
 select balance into amount from public.token_wallets where user_id=p_user for update;
 select * into existing from public.remote_attempts where id=p_request;
 if found then
  if existing.user_id<>p_user or existing.location_id<>p_location then raise exception 'Invalid request'; end if;
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
revoke all on function public.start_remote_attempt(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.start_remote_attempt(uuid,text,uuid) to service_role;
create function public.earn_weekly_passes(p_user uuid) returns integer language plpgsql security invoker set search_path='' as $$
declare k text:='weekly:'||p_user||':'||to_char(now() at time zone 'America/New_York','IYYY-IW'); awarded int;
begin
 if not exists(select 1 from public.runs where user_id=p_user and created_at>=date_trunc('week',now() at time zone 'America/New_York') at time zone 'America/New_York') then raise exception 'Finish a verified round this week to earn two passes'; end if;
 insert into public.token_wallets(user_id) values(p_user) on conflict do nothing;
 perform 1 from public.token_wallets where user_id=p_user for update;
 insert into public.wallet_ledger(user_id,amount,event_key,reason) values(p_user,2,k,'Weekly play reward') on conflict(event_key) do nothing;
 get diagnostics awarded=row_count;
 update public.token_wallets set balance=balance+2*awarded where user_id=p_user;
 return awarded*2;
end $$;
revoke all on function public.earn_weekly_passes(uuid) from public,anon,authenticated;
grant execute on function public.earn_weekly_passes(uuid) to service_role;

-- Private courses are stored separately: no map pins, public runs, throne counts or TP farming.
create table public.private_courses(id uuid primary key default gen_random_uuid(),owner_id uuid not null references public.profiles(id),name text not null check(length(name) between 2 and 40),theme text not null,holes jsonb not null,created_at timestamptz not null default now());
create table public.private_course_members(course_id uuid not null references public.private_courses(id) on delete cascade,user_id uuid not null references public.profiles(id) on delete cascade,primary key(course_id,user_id));
create table public.private_course_runs(id uuid primary key default gen_random_uuid(),course_id uuid not null references public.private_courses(id) on delete cascade,user_id uuid not null references public.profiles(id),score int not null,hole_scores int[] not null,strokes jsonb not null,created_at timestamptz not null default now(),request_id uuid not null unique);
alter table public.private_courses enable row level security;
alter table public.private_course_members enable row level security;
alter table public.private_course_runs enable row level security;
-- All private access is checked by authenticated Edge endpoints, never an enumerable public view.
create table public.store_transactions(id text primary key,user_id uuid not null references public.profiles(id),product_id text not null,environment text not null,revoked_at timestamptz,created_at timestamptz not null default now());
create table public.store_entitlements(user_id uuid not null references public.profiles(id),product_id text not null,transaction_id text not null references public.store_transactions(id),primary key(user_id,product_id));
alter table public.store_transactions enable row level security;
alter table public.store_entitlements enable row level security;
create policy entitlements_read on public.store_entitlements for select to authenticated using(user_id=auth.uid());
grant select on public.store_entitlements to authenticated;
create function public.credit_store_purchase(p_user uuid,p_transaction text,p_product text,p_environment text) returns boolean language plpgsql security invoker set search_path='' as $$
declare tokens int; previous public.store_transactions;
begin
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
revoke all on function public.credit_store_purchase(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.credit_store_purchase(uuid,text,text,text) to service_role;
