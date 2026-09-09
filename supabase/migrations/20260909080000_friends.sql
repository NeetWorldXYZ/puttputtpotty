-- Friends: a code to share, requests both ways, blocks, "last seen", and
-- match invites between friends. Everything goes through security-definer
-- functions keyed on auth.uid(); the tables have no policies of their own.

alter table public.profiles add column if not exists friend_code text unique;
alter table public.profiles add column if not exists last_seen_at timestamptz;

create table if not exists public.friend_links (
  a uuid not null references public.profiles(id) on delete cascade,
  b uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('pending', 'accepted', 'blocked')),
  -- pending: who asked; blocked: who blocked.
  requested_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (a, b),
  check (a < b)
);
alter table public.friend_links enable row level security;

create table if not exists public.match_invites (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  from_user uuid not null references public.profiles(id) on delete cascade,
  to_user uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'sent' check (status in ('sent', 'accepted', 'declined')),
  created_at timestamptz not null default now()
);
create index if not exists match_invites_to_idx on public.match_invites (to_user, status);
alter table public.match_invites enable row level security;

-- "Last seen": the app calls this every couple of minutes while open.
create or replace function public.heartbeat()
returns void language sql security definer set search_path = public as $$
  update public.profiles set last_seen_at = now() where id = auth.uid();
$$;
revoke all on function public.heartbeat() from public, anon;
grant execute on function public.heartbeat() to authenticated;

-- Your friend code, made on first ask: eight unambiguous characters as XXXX-XXXX.
create or replace function public.my_friend_code()
returns text language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  c text;
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  s text;
  i integer;
begin
  if me is null then raise exception 'not signed in'; end if;
  select friend_code into c from public.profiles where id = me;
  if c is not null then return c; end if;
  loop
    s := '';
    for i in 1..8 loop s := s || substr(alphabet, 1 + floor(random() * 32)::int, 1); end loop;
    c := substr(s, 1, 4) || '-' || substr(s, 5, 4);
    begin
      update public.profiles set friend_code = c where id = me;
      return c;
    exception when unique_violation then
    end;
  end loop;
end;
$$;
revoke all on function public.my_friend_code() from public, anon;
grant execute on function public.my_friend_code() to authenticated;

-- How two players stand: me, none, friend, incoming, outgoing, blocked (by me). Blocked by them reads as none.
create or replace function public.friend_relation(me uuid, other uuid)
returns text language sql stable security definer set search_path = public as $$
  select case
    when me = other then 'me'
    when l.status is null then 'none'
    when l.status = 'accepted' then 'friend'
    when l.status = 'blocked' then case when l.requested_by = me then 'blocked' else 'none' end
    when l.requested_by = me then 'outgoing'
    else 'incoming' end
  from (select 1) x
  left join public.friend_links l on l.a = least(me, other) and l.b = greatest(me, other);
$$;
revoke all on function public.friend_relation(uuid, uuid) from public, anon;
grant execute on function public.friend_relation(uuid, uuid) to authenticated;

-- Find a player by code (any case, dash optional) or by the start of their name.
create or replace function public.friend_lookup(q text)
returns table(user_id uuid, display_name text, avatar jsonb, relation text)
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  raw text := upper(regexp_replace(coalesce(q, ''), '[^A-Za-z0-9]', '', 'g'));
begin
  if me is null then raise exception 'not signed in'; end if;
  if length(raw) = 8 and raw ~ '^[A-Z2-9]{8}$' then
    return query
      select p.id, p.display_name, p.avatar, public.friend_relation(me, p.id)
      from public.profiles p where p.friend_code = substr(raw, 1, 4) || '-' || substr(raw, 5, 4) and not p.is_bot;
    if found then return; end if;
  end if;
  if length(trim(coalesce(q, ''))) < 2 then return; end if;
  return query
    select p.id, p.display_name, p.avatar, public.friend_relation(me, p.id)
    from public.profiles p
    where not p.is_bot and p.id <> me and p.display_name ilike replace(replace(trim(q), '%', ''), '_', '') || '%'
    order by p.last_seen_at desc nulls last, p.display_name
    limit 8;
end;
$$;
revoke all on function public.friend_lookup(text) from public, anon;
grant execute on function public.friend_lookup(text) to authenticated;

-- Ask to be friends. If they already asked you, that is a yes. Returns the new relation.
create or replace function public.friend_request(target uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  l public.friend_links;
begin
  if me is null then raise exception 'not signed in'; end if;
  if target = me then raise exception 'that is you'; end if;
  if not exists (select 1 from public.profiles where id = target and not is_bot) then raise exception 'no such player'; end if;
  select * into l from public.friend_links where a = least(me, target) and b = greatest(me, target);
  if found then
    if l.status = 'accepted' then return 'friend'; end if;
    if l.status = 'blocked' then
      if l.requested_by = me then raise exception 'you blocked this player'; end if;
      return 'outgoing'; -- blocked by them: looks sent, goes nowhere
    end if;
    if l.requested_by = me then return 'outgoing'; end if;
    update public.friend_links set status = 'accepted', updated_at = now() where a = l.a and b = l.b;
    return 'friend';
  end if;
  insert into public.friend_links (a, b, status, requested_by) values (least(me, target), greatest(me, target), 'pending', me);
  return 'outgoing';
end;
$$;
revoke all on function public.friend_request(uuid) from public, anon;
grant execute on function public.friend_request(uuid) to authenticated;

-- Answer a request that came to you.
create or replace function public.friend_respond(other uuid, accept boolean)
returns text language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'not signed in'; end if;
  if accept then
    update public.friend_links set status = 'accepted', updated_at = now()
      where a = least(me, other) and b = greatest(me, other) and status = 'pending' and requested_by = other;
    return case when found then 'friend' else public.friend_relation(me, other) end;
  end if;
  delete from public.friend_links where a = least(me, other) and b = greatest(me, other) and status = 'pending';
  return 'none';
end;
$$;
revoke all on function public.friend_respond(uuid, boolean) from public, anon;
grant execute on function public.friend_respond(uuid, boolean) to authenticated;

-- Unfriend, or take back a request.
create or replace function public.friend_remove(other uuid)
returns void language sql security definer set search_path = public as $$
  delete from public.friend_links where a = least(auth.uid(), other) and b = greatest(auth.uid(), other) and status in ('accepted', 'pending');
$$;
revoke all on function public.friend_remove(uuid) from public, anon;
grant execute on function public.friend_remove(uuid) to authenticated;

-- Block: they cannot request or invite you; to them it looks like nothing happened.
create or replace function public.friend_block(other uuid)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null or other = me then return; end if;
  insert into public.friend_links (a, b, status, requested_by) values (least(me, other), greatest(me, other), 'blocked', me)
    on conflict (a, b) do update set status = 'blocked', requested_by = me, updated_at = now();
end;
$$;
revoke all on function public.friend_block(uuid) from public, anon;
grant execute on function public.friend_block(uuid) to authenticated;

-- Your friends and open requests, with an open invite from them if there is one.
create or replace function public.friends_list()
returns table(user_id uuid, display_name text, avatar jsonb, relation text, last_seen_at timestamptz, thrones bigint, invite_id uuid, invite_code text, invite_holes integer)
language sql stable security definer set search_path = public as $$
  select p.id, p.display_name, p.avatar,
    case when l.status = 'accepted' then 'friend' when l.requested_by = auth.uid() then 'outgoing' else 'incoming' end,
    p.last_seen_at,
    (select count(*) from public.thrones t where t.user_id = p.id and t.season = public.current_season()),
    inv.id, inv.code, inv.holes
  from public.friend_links l
  join public.profiles p on p.id = case when l.a = auth.uid() then l.b else l.a end
  left join lateral (
    select i.id, m.code, m.holes from public.match_invites i join public.matches m on m.id = i.match_id
    where i.from_user = p.id and i.to_user = auth.uid() and i.status = 'sent' and m.status = 'waiting' and i.created_at > now() - interval '30 minutes'
    order by i.created_at desc limit 1
  ) inv on true
  where (l.a = auth.uid() or l.b = auth.uid()) and l.status in ('accepted', 'pending')
  order by (l.status = 'pending' and l.requested_by <> auth.uid()) desc, (inv.id is not null) desc, p.last_seen_at desc nulls last, p.display_name;
$$;
revoke all on function public.friends_list() from public, anon;
grant execute on function public.friends_list() to authenticated;

-- Invite a friend to a match you opened (an invite match, still waiting).
create or replace function public.invite_friend(to_user uuid, in_match uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  m public.matches;
  inv uuid;
begin
  if me is null then raise exception 'not signed in'; end if;
  if public.friend_relation(me, to_user) <> 'friend' then raise exception 'you are not friends yet'; end if;
  select * into m from public.matches where id = in_match;
  if not found or m.p1 <> me or m.status <> 'waiting' or m.code is null then raise exception 'that match is not open for invites'; end if;
  -- One open invite per pair: the newest match replaces the old ask.
  update public.match_invites set status = 'declined' where from_user = me and to_user = invite_friend.to_user and status = 'sent';
  insert into public.match_invites (match_id, from_user, to_user) values (in_match, me, to_user) returning id into inv;
  return inv;
end;
$$;
revoke all on function public.invite_friend(uuid, uuid) from public, anon;
grant execute on function public.invite_friend(uuid, uuid) to authenticated;

-- Invites waiting for you: the match is still open and the ask is fresh.
create or replace function public.my_invites()
returns table(id uuid, match_id uuid, code text, holes integer, from_user uuid, from_name text, from_avatar jsonb, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select i.id, i.match_id, m.code, m.holes, i.from_user, p.display_name, p.avatar, i.created_at
  from public.match_invites i
  join public.matches m on m.id = i.match_id
  join public.profiles p on p.id = i.from_user
  where i.to_user = auth.uid() and i.status = 'sent' and m.status = 'waiting' and i.created_at > now() - interval '30 minutes'
    and public.friend_relation(auth.uid(), i.from_user) = 'friend'
  order by i.created_at desc;
$$;
revoke all on function public.my_invites() from public, anon;
grant execute on function public.my_invites() to authenticated;

create or replace function public.invite_respond(in_id uuid, accept boolean)
returns void language sql security definer set search_path = public as $$
  update public.match_invites set status = case when accept then 'accepted' else 'declined' end
    where id = in_id and to_user = auth.uid() and status = 'sent';
$$;
revoke all on function public.invite_respond(uuid, boolean) from public, anon;
grant execute on function public.invite_respond(uuid, boolean) to authenticated;
