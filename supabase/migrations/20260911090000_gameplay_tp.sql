-- Reconciled against production: gameplay TP already exists in throne_points.
-- Preserve existing terms/rates and add the missing completed-match aces.
create or replace function public.throne_points(in_user uuid)
returns integer language sql stable set search_path=public as $$
  select (
    (select coalesce(sum(c.points),0) from challenge_claims c where c.user_id=in_user)
    +10*(select count(*) from matches m where m.status='done' and ((m.p1=in_user and m.p1_score is not null) or (m.p2=in_user and m.p2_score is not null)))
    +30*(select count(*) from matches m where m.winner=in_user)
    +15*(select count(*) filter(where r.location_id is null and r.score=1)
      +coalesce(sum((select count(*) from unnest(r.hole_scores) h where h=1)),0) from runs r where r.user_id=in_user)
    +25*(select count(*) from runs r where r.user_id=in_user and r.location_id is not null)
    +15*(select count(*) from (select r.course_seed from runs r where r.user_id=in_user and r.course_seed is not null group by r.course_seed having count(*)>=9) d)
    +15*(select coalesce(sum((select count(*) from unnest(case when m.p1=in_user then m.p1_holes else m.p2_holes end) h where h=1)),0)
      from matches m where m.status='done' and ((m.p1=in_user and m.p1_score is not null) or (m.p2=in_user and m.p2_score is not null)))
  )::integer;
$$;

-- Read-only earnings for one exact verified round, scoped to the caller.
create or replace function public.gameplay_reward(in_context text) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare u uuid:=auth.uid(); m matches%rowtype; r runs%rowtype; base integer:=0; bonus integer:=0; aces integer:=0; label text; items jsonb:='[]'::jsonb; n integer;
begin
  if u is null then raise exception 'Sign in first'; end if;
  if in_context like 'match:%' then
    select * into m from matches where id::text=substring(in_context from 7) and (p1=u or p2=u) and status='done';
    if not found then return jsonb_build_object('available',false,'points',0,'items',items); end if;
    if (m.p1=u and m.p1_score is not null) or (m.p2=u and m.p2_score is not null) then
      base:=10;
      select count(*) into aces from unnest(case when m.p1=u then m.p1_holes else m.p2_holes end) h where h=1;
    end if;
    if m.winner=u then bonus:=30; end if;
    label:='Match completed';
  elsif in_context like 'run:%' then
    select * into r from runs where id::text=substring(in_context from 5) and user_id=u and location_id is not null;
    if not found then return jsonb_build_object('available',false,'points',0,'items',items); end if;
    base:=25; label:='Throne round';
    select count(*) into aces from unnest(r.hole_scores) h where h=1;
  elsif in_context like 'daily:%' then
    select count(*),count(*) filter(where score=1) into n,aces from runs where user_id=u and course_seed=substring(in_context from 7) and location_id is null;
    if n<9 then return jsonb_build_object('available',false,'points',0,'items',items); end if;
    base:=15; label:='Daily course';
  else raise exception 'Unknown reward context'; end if;
  if base>0 then items:=items||jsonb_build_array(jsonb_build_object('reason',label,'points',base)); end if;
  if bonus>0 then items:=items||jsonb_build_array(jsonb_build_object('reason','Match won','points',bonus)); end if;
  if aces>0 then items:=items||jsonb_build_array(jsonb_build_object('reason','Aces','points',aces*15)); end if;
  return jsonb_build_object('available',true,'points',base+bonus+aces*15,'items',items);
end;
$$;
revoke all on function public.gameplay_reward(text) from public,anon;
grant execute on function public.gameplay_reward(text) to authenticated;
notify pgrst,'reload schema';
