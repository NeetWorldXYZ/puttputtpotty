-- Quick match: two players, the same three holes, live progress over Realtime,
-- results verified by the edge function's replay.
create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  seed text not null,
  code text unique,
  status text not null default 'waiting' check (status in ('waiting', 'playing', 'done', 'cancelled')),
  p1 uuid not null references public.profiles(id),
  p2 uuid references public.profiles(id),
  p1_score integer,
  p1_holes integer[],
  p1_elapsed_ms integer,
  p2_score integer,
  p2_holes integer[],
  p2_elapsed_ms integer,
  winner uuid,
  forfeit boolean not null default false,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);
create index if not exists matches_waiting on public.matches (created_at) where status = 'waiting' and code is null;
alter table public.matches enable row level security;
create policy "matches readable by players" on public.matches for select using (auth.uid() = p1 or auth.uid() = p2);

create or replace function public.match_seed()
returns text language sql volatile set search_path = public as $$
  select 'm-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
$$;

-- Random matchmaking: join the oldest open public match or open a new one.
create or replace function public.find_match()
returns setof public.matches
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  m public.matches;
begin
  if me is null then raise exception 'not signed in'; end if;
  -- leave any of my own stale waiting matches
  update public.matches set status = 'cancelled' where p1 = me and status = 'waiting';
  select * into m from public.matches
    where status = 'waiting' and code is null and p1 <> me and created_at > now() - interval '3 minutes'
    order by created_at for update skip locked limit 1;
  if found then
    update public.matches set p2 = me, status = 'playing', started_at = now() where id = m.id returning * into m;
  else
    insert into public.matches (seed, p1) values (public.match_seed(), me) returning * into m;
  end if;
  return next m;
end;
$$;

-- Invite a friend: a 6-letter code they enter (or a link that carries it).
create or replace function public.create_invite()
returns setof public.matches
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  m public.matches;
  c text;
begin
  if me is null then raise exception 'not signed in'; end if;
  update public.matches set status = 'cancelled' where p1 = me and status = 'waiting';
  loop
    c := upper(substr(translate(replace(gen_random_uuid()::text, '-', ''), '0123456789', 'ABCDEFGHJK'), 1, 6));
    begin
      insert into public.matches (seed, p1, code) values (public.match_seed(), me, c) returning * into m;
      exit;
    exception when unique_violation then
    end;
  end loop;
  return next m;
end;
$$;

create or replace function public.join_invite(in_code text)
returns setof public.matches
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  m public.matches;
begin
  if me is null then raise exception 'not signed in'; end if;
  select * into m from public.matches where code = upper(trim(in_code)) and status = 'waiting' for update;
  if not found then raise exception 'No open match with that code'; end if;
  if m.p1 = me then raise exception 'That is your own invite'; end if;
  update public.matches set p2 = me, status = 'playing', started_at = now() where id = m.id returning * into m;
  return next m;
end;
$$;

create or replace function public.cancel_match(in_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.matches set status = 'cancelled' where id = in_id and p1 = auth.uid() and status = 'waiting';
$$;

-- Read a match with both players' names, resolving forfeits on the way.
create or replace function public.match_state(in_id uuid)
returns table (
  id uuid, seed text, code text, status text, p1 uuid, p2 uuid, p1_name text, p2_name text,
  p1_score integer, p1_holes integer[], p1_elapsed_ms integer, p2_score integer, p2_holes integer[], p2_elapsed_ms integer,
  winner uuid, forfeit boolean, started_at timestamptz, finished_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  m public.matches;
begin
  select * into m from public.matches where matches.id = in_id;
  if not found or (m.p1 <> me and m.p2 is distinct from me) then raise exception 'no such match'; end if;
  -- Forfeit: one side finished, the other has had ten minutes since the start.
  if m.status = 'playing' and m.started_at < now() - interval '10 minutes' and ((m.p1_score is not null) <> (m.p2_score is not null)) then
    update public.matches set status = 'done', forfeit = true, finished_at = now(),
      winner = case when p1_score is not null then p1 else p2 end
      where matches.id = in_id returning * into m;
  end if;
  return query select m.id, m.seed, m.code, m.status, m.p1, m.p2,
    (select display_name from public.profiles where profiles.id = m.p1), (select display_name from public.profiles where profiles.id = m.p2),
    m.p1_score, m.p1_holes, m.p1_elapsed_ms, m.p2_score, m.p2_holes, m.p2_elapsed_ms, m.winner, m.forfeit, m.started_at, m.finished_at;
end;
$$;

grant execute on function public.find_match(), public.create_invite(), public.join_invite(text), public.cancel_match(uuid), public.match_state(uuid) to authenticated;
revoke execute on function public.find_match(), public.create_invite(), public.join_invite(text), public.cancel_match(uuid), public.match_state(uuid) from anon, public;
