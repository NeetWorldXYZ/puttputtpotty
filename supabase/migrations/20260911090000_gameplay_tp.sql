-- New verified play earns TP from installation onward. Existing challenge TP is preserved.
-- Each payment has a unique server-derived key. Clients have no write access.
create table public.gameplay_tp (
  user_id uuid not null references auth.users(id) on delete cascade,
  award_key text not null,
  context text not null,
  reason text not null,
  points integer not null check(points > 0),
  created_at timestamptz not null default now(),
  primary key(user_id, award_key)
);
create index gameplay_tp_context on public.gameplay_tp(user_id, context);
alter table public.gameplay_tp enable row level security;
create policy "own gameplay rewards" on public.gameplay_tp for select to authenticated using(user_id=auth.uid());
grant select on public.gameplay_tp to authenticated;

create function public.record_gameplay_tp(u uuid, k text, c text, r text, p integer)
returns void language sql security definer set search_path=public as $$
  insert into gameplay_tp(user_id,award_key,context,reason,points)
  select u,k,c,r,p where u is not null and p>0 on conflict do nothing;
$$;
revoke all on function public.record_gameplay_tp(uuid,text,text,text,integer) from public,anon,authenticated;

-- Serialize verified submissions for one player/course and record previous throne owner.
create function public.lock_tp_run() returns trigger language plpgsql security definer set search_path=public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('tp:'||new.user_id::text,0));
  if new.location_id is not null then
    perform pg_advisory_xact_lock(hashtextextended('tp-location:'||new.location_id,0));
  end if;
  return new;
end; $$;
create trigger lock_tp_run before insert on public.runs for each row execute function public.lock_tp_run();

create function public.reward_tp_run() returns trigger language plpgsql security definer set search_path=public as $$
declare c text; a integer; previous_owner uuid; current_owner uuid; count_holes integer;
begin
  if new.location_id is not null and cardinality(new.hole_scores)=3 then
    c:='run:'||new.id::text;
    -- Completion/aces paid once per location per Eastern day to discourage repeat farming.
    if not exists(select 1 from gameplay_tp where user_id=new.user_id and award_key=
      'visit:'||new.location_id||':'||to_char(new.created_at at time zone 'America/New_York','YYYY-MM-DD')) then
      perform record_gameplay_tp(new.user_id,'visit:'||new.location_id||':'||to_char(new.created_at at time zone 'America/New_York','YYYY-MM-DD'),c,'Throne round',20);
      select count(*) into a from unnest(new.hole_scores) h where h=1;
      perform record_gameplay_tp(new.user_id,c||':aces',c,'Aces',a*10);
    end if;
    select user_id into previous_owner from runs where location_id=new.location_id and season=new.season and id<>new.id and hole_scores is not null
      order by score,coalesce(elapsed_ms,2147483647),created_at limit 1;
    select user_id into current_owner from thrones where location_id=new.location_id and season=new.season;
    if current_owner=new.user_id and previous_owner is distinct from new.user_id then
      perform record_gameplay_tp(new.user_id,'capture:'||new.season::text||':'||new.location_id,c,'Throne captured',50);
    end if;
  elsif new.location_id is null and new.course_seed ~ '^\d{4}-\d{2}-\d{2}-(am|pm)$' then
    c:='daily:'||new.course_seed;
    -- Only a complete verified set of holes qualifies. Partial courses earn nothing.
    select count(distinct hole_index) into count_holes from runs where user_id=new.user_id and course_seed=new.course_seed and hole_index between 0 and 8;
    if count_holes=9 then
      perform record_gameplay_tp(new.user_id,c||':finish',c,'Daily course',30);
      select count(distinct hole_index) into a from runs where user_id=new.user_id and course_seed=new.course_seed and hole_index between 0 and 8 and score=1;
      perform record_gameplay_tp(new.user_id,c||':aces',c,'Aces',a*10);
    end if;
  end if;
  return new;
end; $$;
create trigger reward_tp_run after insert on public.runs for each row execute function public.reward_tp_run();

create function public.reward_tp_match() returns trigger language plpgsql security definer set search_path=public as $$
declare u uuid; scores integer[]; s integer; a integer; c text; i integer;
begin
  if new.status<>'done' or old.status='done' then return new; end if;
  c:='match:'||new.id::text;
  for i in 1..2 loop
    if i=1 then u:=new.p1; scores:=new.p1_holes; s:=new.p1_score;
    else u:=new.p2; scores:=new.p2_holes; s:=new.p2_score; end if;
    if u is null or (i=2 and new.p2_bot) or s is null or cardinality(scores) is distinct from new.holes then continue; end if;
    perform record_gameplay_tp(u,c||':finish',c,'Match completed',20);
    if new.winner=u then perform record_gameplay_tp(u,c||':win',c,'Match won',20); end if;
    select count(*) into a from unnest(scores) h where h=1;
    perform record_gameplay_tp(u,c||':aces',c,'Aces',a*10);
  end loop;
  return new;
end; $$;
create trigger reward_tp_match after update of status on public.matches for each row execute function public.reward_tp_match();
revoke all on function public.lock_tp_run(), public.reward_tp_run(), public.reward_tp_match() from public,anon,authenticated;

create function public.gameplay_reward(in_context text) returns jsonb
language sql stable security definer set search_path=public as $$
  select jsonb_build_object('points',coalesce(sum(points),0),'items',coalesce(jsonb_agg(jsonb_build_object('reason',reason,'points',points) order by award_key),'[]'::jsonb))
  from gameplay_tp where user_id=auth.uid() and context=in_context;
$$;
revoke all on function public.gameplay_reward(text) from public,anon;
grant execute on function public.gameplay_reward(text) to authenticated;

-- Wrap existing profile logic to preserve all current fields and stats.
alter function public.player_profile(uuid) rename to player_profile_before_gameplay_tp;
create function public.player_profile(in_user uuid) returns jsonb
language sql stable security definer set search_path=public as $$
  select public.player_profile_before_gameplay_tp(in_user) || jsonb_build_object('points',
    (select coalesce(sum(points),0) from challenge_claims where user_id=in_user)+
    (select coalesce(sum(points),0) from gameplay_tp where user_id=in_user));
$$;
revoke all on function public.player_profile_before_gameplay_tp(uuid) from public,anon,authenticated;
grant execute on function public.player_profile(uuid) to anon,authenticated,service_role;

-- Account transfer must carry earned rewards as well as the old gameplay records.
alter function public.move_account(uuid,uuid) rename to move_account_before_gameplay_tp;
create function public.move_account(old_id uuid,new_id uuid) returns text
language plpgsql security definer set search_path=public as $$
begin
  if old_id=new_id then raise exception 'same account'; end if;
  if not exists(select 1 from profiles where id=old_id) then raise exception 'no such account'; end if;
  delete from gameplay_tp where user_id=new_id;
  update gameplay_tp set user_id=new_id where user_id=old_id;
  return move_account_before_gameplay_tp(old_id,new_id);
end; $$;
revoke all on function public.move_account_before_gameplay_tp(uuid,uuid),public.move_account(uuid,uuid) from public,anon,authenticated;
grant execute on function public.move_account(uuid,uuid) to service_role;
notify pgrst,'reload schema';
