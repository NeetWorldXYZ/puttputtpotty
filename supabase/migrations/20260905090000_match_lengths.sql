-- Random matchmaking is nine holes; invites choose 3, 9 or 18. Forfeit window scales with length.
alter table public.matches add column if not exists holes integer not null default 9 check (holes in (3, 9, 18));

create or replace function public.find_match()
returns setof public.matches
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  m public.matches;
begin
  if me is null then raise exception 'not signed in'; end if;
  update public.matches set status = 'cancelled' where p1 = me and status = 'waiting';
  select * into m from public.matches
    where status = 'waiting' and code is null and p1 <> me and created_at > now() - interval '3 minutes'
    order by created_at for update skip locked limit 1;
  if found then
    update public.matches set p2 = me, status = 'playing', started_at = now() where id = m.id returning * into m;
  else
    insert into public.matches (seed, p1, holes) values (public.match_seed(), me, 9) returning * into m;
  end if;
  return next m;
end;
$$;

drop function if exists public.create_invite();
create or replace function public.create_invite(in_holes integer default 9)
returns setof public.matches
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  m public.matches;
  c text;
begin
  if me is null then raise exception 'not signed in'; end if;
  if in_holes not in (3, 9, 18) then raise exception 'holes must be 3, 9 or 18'; end if;
  update public.matches set status = 'cancelled' where p1 = me and status = 'waiting';
  loop
    c := upper(substr(translate(replace(gen_random_uuid()::text, '-', ''), '0123456789', 'ABCDEFGHJK'), 1, 6));
    begin
      insert into public.matches (seed, p1, code, holes) values (public.match_seed(), me, c, in_holes) returning * into m;
      exit;
    exception when unique_violation then
    end;
  end loop;
  return next m;
end;
$$;
grant execute on function public.create_invite(integer) to authenticated;
revoke execute on function public.create_invite(integer) from anon, public;

drop function if exists public.match_state(uuid);
create or replace function public.match_state(in_id uuid)
returns table (
  id uuid, seed text, code text, status text, holes integer, p1 uuid, p2 uuid, p1_name text, p2_name text,
  p1_score integer, p1_holes integer[], p1_elapsed_ms integer, p2_score integer, p2_holes integer[], p2_elapsed_ms integer,
  winner uuid, forfeit boolean, started_at timestamptz, finished_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  m public.matches;
begin
  select * into m from public.matches where matches.id = in_id;
  if not found or (m.p1 <> me and m.p2 is distinct from me) then raise exception 'no such match'; end if;
  if m.status = 'playing' and m.started_at < now() - (interval '10 minutes') * (m.holes / 3.0) and ((m.p1_score is not null) <> (m.p2_score is not null)) then
    update public.matches set status = 'done', forfeit = true, finished_at = now(),
      winner = case when p1_score is not null then p1 else p2 end
      where matches.id = in_id returning * into m;
  end if;
  return query select m.id, m.seed, m.code, m.status, m.holes, m.p1, m.p2,
    (select display_name from public.profiles where profiles.id = m.p1), (select display_name from public.profiles where profiles.id = m.p2),
    m.p1_score, m.p1_holes, m.p1_elapsed_ms, m.p2_score, m.p2_holes, m.p2_elapsed_ms, m.winner, m.forfeit, m.started_at, m.finished_at;
end;
$$;
grant execute on function public.match_state(uuid) to authenticated;
revoke execute on function public.match_state(uuid) from anon, public;
